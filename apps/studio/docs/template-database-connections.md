# 解决模板数据库连接问题

## 问题描述

当使用 PostgreSQL 的 `postgres` 数据库（或任何其他数据库）作为模板创建新数据库时，如果模板数据库有活动连接，PostgreSQL 会报错：

```
ERROR: source database "postgres" is being accessed by other users
DETAIL: There is 1 other session using the database.
```

这是因为 PostgreSQL 在使用数据库作为模板时，需要确保模板数据库处于静止状态，不能有任何活动连接。

## 解决方案

我们实现了两种解决方案，它们会自动应用：

### 方案 1: 使用 FORCE 选项（PostgreSQL 13+）

**实现位置**: `apps/studio/lib/api/self-hosted/database-manager.ts`

```typescript
// 在 CREATE DATABASE 语句中添加 FORCE 选项
CREATE DATABASE "new_db" WITH TEMPLATE "postgres" FORCE
```

**工作原理**:
- `FORCE` 选项会自动终止模板数据库的所有活动连接
- 这是 PostgreSQL 13 及更高版本的特性
- 最简单、最可靠的解决方案

**优点**:
- ✅ 自动处理，无需额外代码
- ✅ 原子操作，不会有竞态条件
- ✅ PostgreSQL 内置功能，性能最优

**缺点**:
- ❌ 需要 PostgreSQL 13 或更高版本
- ❌ 会强制断开所有连接（可能影响其他用户）

### 方案 2: 手动终止连接（备用方案）

**实现位置**: `apps/studio/lib/api/self-hosted/database-manager.ts`

```typescript
// 在创建数据库之前，先终止所有连接
export async function terminateConnections(name: string): Promise<WrappedResult<number>> {
  const query = `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1
      AND pid <> pg_backend_pid()
  `
  // ... 执行查询
}
```

**工作原理**:
1. 查询 `pg_stat_activity` 获取所有连接到模板数据库的进程
2. 使用 `pg_terminate_backend()` 终止这些连接
3. 排除当前连接（`pg_backend_pid()`）
4. 然后创建新数据库

**优点**:
- ✅ 兼容所有 PostgreSQL 版本
- ✅ 可以选择性终止连接
- ✅ 提供更多控制

**缺点**:
- ❌ 需要额外的查询
- ❌ 可能存在竞态条件（终止连接后，新连接可能立即建立）
- ❌ 代码更复杂

## 当前实现

我们的实现结合了两种方案：

```typescript
// 1. 首先尝试终止连接（兼容性方案）
const terminateResult = await terminateConnections(template)
if (terminateResult.error) {
  console.warn(`Warning: Could not terminate connections to template database "${template}":`, terminateResult.error)
  // 继续执行 - CREATE DATABASE 可能仍然成功
}

// 2. 使用 FORCE 选项创建数据库（PostgreSQL 13+）
let query = `CREATE DATABASE "${name}" WITH TEMPLATE "${template}" FORCE`
```

**为什么这样做**:
- 如果是 PostgreSQL 13+，`FORCE` 选项会确保成功
- 如果是旧版本，手动终止连接提供了备用方案
- 即使手动终止失败，`FORCE` 选项仍然会尝试

## 使用场景

### 场景 1: 开发环境

在开发环境中，`postgres` 数据库通常有多个活动连接：
- Studio 的连接
- pg-meta 的连接
- 其他开发工具的连接

**解决方案**: 自动终止这些连接不会造成问题，因为它们会自动重连。

### 场景 2: 生产环境

在生产环境中，需要更谨慎：
- 可能有关键应用连接到模板数据库
- 强制断开连接可能影响服务

**建议**:
1. 使用专门的模板数据库（不是 `postgres`）
2. 确保模板数据库没有应用连接
3. 在维护窗口期间创建新项目

### 场景 3: 自托管环境

在自托管环境中：
- 通常只有 Studio 和 Supabase 服务连接
- 可以安全地使用 `FORCE` 选项

## 配置建议

### 推荐配置 1: 使用专门的模板数据库

```bash
# 1. 创建专门的模板数据库
docker exec -it supabase-db psql -U postgres -c "CREATE DATABASE supabase_template"

# 2. 设置模板数据库的 schema
docker exec -it supabase-db psql -U postgres -d supabase_template -f /path/to/schema.sql

# 3. 配置 Studio 使用这个模板
# apps/studio/.env
TEMPLATE_DATABASE_NAME=supabase_template
```

**优点**:
- ✅ 模板数据库没有活动连接
- ✅ 不会影响 `postgres` 数据库
- ✅ 可以自定义模板内容
- ✅ 更清晰的职责分离

### 推荐配置 2: 使用 postgres 数据库（简单）

```bash
# apps/studio/.env
TEMPLATE_DATABASE_NAME=postgres
```

**优点**:
- ✅ 无需额外设置
- ✅ 使用默认数据库
- ✅ 适合快速开发

**注意事项**:
- ⚠️ 需要 PostgreSQL 13+ 或手动终止连接
- ⚠️ 可能影响其他连接到 postgres 的服务

## PostgreSQL 版本兼容性

| PostgreSQL 版本 | FORCE 选项 | 手动终止连接 | 推荐方案 |
|----------------|-----------|------------|---------|
| 9.x - 12.x     | ❌ 不支持  | ✅ 支持     | 使用专门的模板数据库 |
| 13.x+          | ✅ 支持    | ✅ 支持     | 使用 FORCE 选项 |

## 检查 PostgreSQL 版本

```bash
# 方法 1: 使用 docker
docker exec -it supabase-db psql -U postgres -c "SELECT version();"

# 方法 2: 直接连接
psql -h localhost -U postgres -c "SELECT version();"

# 输出示例:
# PostgreSQL 15.1 on x86_64-pc-linux-gnu, compiled by gcc (Debian 10.2.1-6) 10.2.1 20210110, 64-bit
```

## 故障排除

### 问题 1: 仍然报错 "database is being accessed by other users"

**可能原因**:
- PostgreSQL 版本低于 13，不支持 FORCE 选项
- 手动终止连接失败
- 新连接在终止后立即建立

**解决方案**:
```bash
# 1. 检查 PostgreSQL 版本
docker exec -it supabase-db psql -U postgres -c "SELECT version();"

# 2. 手动终止所有连接
docker exec -it supabase-db psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'postgres'
  AND pid <> pg_backend_pid();
"

# 3. 立即创建数据库
docker exec -it supabase-db psql -U postgres -c "
CREATE DATABASE test_db WITH TEMPLATE postgres;
"
```

### 问题 2: 权限不足

**错误信息**:
```
ERROR: permission denied to create database
```

**解决方案**:
```bash
# 授予 CREATEDB 权限
docker exec -it supabase-db psql -U postgres -c "
ALTER USER postgres CREATEDB;
"
```

### 问题 3: 模板数据库不存在

**错误信息**:
```
ERROR: template database "my_template" does not exist
```

**解决方案**:
```bash
# 检查数据库是否存在
docker exec -it supabase-db psql -U postgres -c "\l"

# 创建模板数据库
docker exec -it supabase-db psql -U postgres -c "
CREATE DATABASE my_template;
"

# 更新 .env 配置
# TEMPLATE_DATABASE_NAME=my_template
```

## 最佳实践

### 1. 使用专门的模板数据库

```bash
# 创建并配置模板数据库
docker exec -it supabase-db psql -U postgres << EOF
-- 创建模板数据库
CREATE DATABASE supabase_template;

-- 连接到模板数据库
\c supabase_template

-- 添加扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建基础表结构
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 设置权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
EOF
```

### 2. 定期清理未使用的数据库

```bash
# 列出所有数据库及其大小
docker exec -it supabase-db psql -U postgres -c "
SELECT 
  datname,
  pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datistemplate = false
ORDER BY pg_database_size(datname) DESC;
"

# 删除未使用的数据库
docker exec -it supabase-db psql -U postgres -c "
DROP DATABASE IF EXISTS old_project_db;
"
```

### 3. 监控连接数

```bash
# 查看每个数据库的连接数
docker exec -it supabase-db psql -U postgres -c "
SELECT 
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname
ORDER BY connections DESC;
"
```

### 4. 设置连接限制

```bash
# 限制模板数据库的连接数
docker exec -it supabase-db psql -U postgres -c "
ALTER DATABASE postgres CONNECTION LIMIT 10;
"
```

## 相关文档

- [PostgreSQL CREATE DATABASE 文档](https://www.postgresql.org/docs/current/sql-createdatabase.html)
- [PostgreSQL pg_terminate_backend 文档](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL)
- [多数据库配置指南](./multi-database-configuration.md)
- [快速参考指南](./multi-database-quick-reference.md)

## 总结

我们的实现通过以下方式解决了模板数据库连接问题：

1. ✅ **自动处理**: 使用 `FORCE` 选项自动终止连接
2. ✅ **向后兼容**: 提供手动终止连接的备用方案
3. ✅ **错误处理**: 优雅地处理各种错误情况
4. ✅ **灵活配置**: 支持使用任何数据库作为模板

**推荐做法**:
- 开发环境: 使用 `postgres` 数据库 + `FORCE` 选项
- 生产环境: 使用专门的模板数据库，避免影响其他服务
