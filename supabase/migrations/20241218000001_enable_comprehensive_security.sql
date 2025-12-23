-- Enable comprehensive security across all Supabase APIs
-- This migration enables Row Level Security (RLS) and creates authentication policies

-- Enable RLS on auth schema tables (if they exist)
DO $$
BEGIN
    -- Enable RLS on common tables (create them if they don't exist)
    
    -- Users/Profiles table
    CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID REFERENCES auth.users(id) PRIMARY KEY,
        email TEXT,
        full_name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    
    -- Posts table (example content table)
    CREATE TABLE IF NOT EXISTS public.posts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
    
    -- Comments table (example content table)
    CREATE TABLE IF NOT EXISTS public.comments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        post_id UUID REFERENCES public.posts(id) NOT NULL,
        user_id UUID REFERENCES auth.users(id) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating tables: %', SQLERRM;
END $$;

-- Create RLS policies for profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for posts table
DROP POLICY IF EXISTS "Authenticated users can view all posts" ON public.posts;
CREATE POLICY "Authenticated users can view all posts" ON public.posts
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts" ON public.posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts" ON public.posts
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for comments table
DROP POLICY IF EXISTS "Authenticated users can view all comments" ON public.comments;
CREATE POLICY "Authenticated users can view all comments" ON public.comments
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create their own comments" ON public.comments;
CREATE POLICY "Users can create their own comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- Deny anonymous access to all tables
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
CREATE POLICY "Deny anonymous access to profiles" ON public.profiles
    FOR ALL USING (auth.role() != 'anon');

DROP POLICY IF EXISTS "Deny anonymous access to posts" ON public.posts;
CREATE POLICY "Deny anonymous access to posts" ON public.posts
    FOR ALL USING (auth.role() != 'anon');

DROP POLICY IF EXISTS "Deny anonymous access to comments" ON public.comments;
CREATE POLICY "Deny anonymous access to comments" ON public.comments
    FOR ALL USING (auth.role() != 'anon');

-- Create storage policies for private buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('user_avatars', 'user_avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('user_documents', 'user_documents', false, 52428800, ARRAY['application/pdf', 'text/plain', 'application/msword']),
    ('private_files', 'private_files', false, 104857600, NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user_avatars bucket
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'user_avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can view their own avatar" ON storage.objects;
CREATE POLICY "Users can view their own avatar" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'user_avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'user_avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'user_avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for user_documents bucket
DROP POLICY IF EXISTS "Users can manage their own documents" ON storage.objects;
CREATE POLICY "Users can manage their own documents" ON storage.objects
    FOR ALL USING (
        bucket_id = 'user_documents' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for private_files bucket
DROP POLICY IF EXISTS "Authenticated users can manage private files" ON storage.objects;
CREATE POLICY "Authenticated users can manage private files" ON storage.objects
    FOR ALL USING (
        bucket_id = 'private_files' AND 
        auth.role() = 'authenticated'
    );

-- Enable realtime for authenticated users only
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- Create function to handle user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Revoke permissions from anonymous users
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

COMMENT ON TABLE public.profiles IS 'User profiles with RLS enabled - users can only access their own data';
COMMENT ON TABLE public.posts IS 'User posts with RLS enabled - authenticated users can view all, users can only modify their own';
COMMENT ON TABLE public.comments IS 'User comments with RLS enabled - authenticated users can view all, users can only modify their own';