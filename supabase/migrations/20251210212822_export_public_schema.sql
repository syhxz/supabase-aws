--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: studio_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_projects (
    id integer NOT NULL,
    ref text NOT NULL,
    name text NOT NULL,
    database_name text NOT NULL,
    organization_id integer DEFAULT 1 NOT NULL,
    owner_user_id text,
    status text DEFAULT 'ACTIVE_HEALTHY'::text NOT NULL,
    region text DEFAULT 'localhost'::text NOT NULL,
    connection_string text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: studio_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.studio_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: studio_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.studio_projects_id_seq OWNED BY public.studio_projects.id;


--
-- Name: studio_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_projects ALTER COLUMN id SET DEFAULT nextval('public.studio_projects_id_seq'::regclass);


--
-- Name: studio_projects studio_projects_database_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_projects
    ADD CONSTRAINT studio_projects_database_name_key UNIQUE (database_name);


--
-- Name: studio_projects studio_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_projects
    ADD CONSTRAINT studio_projects_pkey PRIMARY KEY (id);


--
-- Name: studio_projects studio_projects_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_projects
    ADD CONSTRAINT studio_projects_ref_key UNIQUE (ref);


--
-- PostgreSQL database dump complete
--

