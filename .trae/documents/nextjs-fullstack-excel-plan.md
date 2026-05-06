# Next.js 全栈项目 + Vercel 部署 + Excel 导入导出 实施计划

## 一、项目概述

使用 Next.js (App Router) 实现一个全栈应用，包含前后端 + 数据库，支持 Excel 导入导出功能，最终部署到 Vercel。

## 二、技术栈

| 层次       | 技术                                   | 说明                 |
| -------- | ------------------------------------ | ------------------ |
| 前端/后端框架  | Next.js 15 (App Router) + TypeScript | 全栈开发，前后端一体         |
| UI 样式    | Tailwind CSS                         | 快速构建响应式 UI         |
| 数据库      | Vercel Postgres (Neon)               | Vercel 官方推荐，零配置托管  |
| ORM      | Prisma                               | 类型安全，自动迁移          |
| Excel 处理 | xlsx (SheetJS)                       | 前后端通用，支持读写 Excel   |
| 部署平台     | Vercel                               | Next.js 官方推荐，零配置部署 |

## 三、Vercel 推荐数据库方案对比

Vercel 官方在 Marketplace 中推荐以下数据库方案，均可在 Vercel Dashboard → Storage 中一键创建并自动注入环境变量：

| 数据库                 | 底层提供商         | 类型                 | 免费额度                   | 适用场景              | 与本项目匹配度        |
| ------------------- | ------------- | ------------------ | ---------------------- | ----------------- | -------------- |
| **Vercel Postgres** | Neon          | 关系型 PostgreSQL     | 500MB 存储 + 100h 计算/月   | 结构化数据、CRUD、事务     | ⭐⭐⭐⭐⭐ 最佳选择     |
| Vercel KV           | Upstash       | 键值存储 (Redis)       | 30k 请求/天               | 会话管理、缓存、限流        | ❌ 不适合 Excel 场景 |
| Vercel Blob         | Cloudflare R2 | 对象存储               | 250MB 存储               | 图片/视频/大文件存储       | ❌ 不适合结构化数据     |
| Supabase            | Supabase      | PostgreSQL + BaaS  | 500MB + Auth + Storage | 全栈快速开发            | ⭐⭐⭐⭐ 可选替代      |
| Turso               | Turso         | 边缘 SQLite (libSQL) | 9GB + 10亿行读取/月         | 边缘计算、低延迟          | ⭐⭐⭐ 可选替代       |
| MongoDB Atlas       | MongoDB       | 文档型 NoSQL          | 512MB                  | 灵活 Schema、JSON 数据 | ⭐⭐ 不推荐         |

### 推荐方案：Vercel Postgres (Neon)

**选择理由：**

1. **Vercel 官方深度集成**：在 Vercel Dashboard 一键创建，环境变量自动注入，零配置
2. **Prisma 完美兼容**：Neon PostgreSQL 是 Prisma 支持最好的数据库之一
3. **Serverless 原生**：计算与存储分离，自动扩缩容，按需付费，空闲不收费
4. **免费额度充足**：500MB 存储 + 每月 100 小时计算，足够开发和中小型项目使用
5. **与 Next.js App Router 深度集成**：官方模板默认使用 Vercel Postgres + Prisma
6. **支持连接池**：通过 `@neondatabase/serverless` 驱动支持 Edge Function，避免 Serverless 连接耗尽

**备选方案：Supabase**

如果需要额外的认证 (Auth)、实时订阅 (Realtime)、文件存储 (Storage) 等功能，可以选择 Supabase。但对于本项目的 Excel 导入导出场景，Vercel Postgres 已完全满足需求。

## 四、项目结构

```
nextjsweb/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 首页（数据列表展示）
│   │   ├── globals.css             # 全局样式
│   │   └── api/
│   │       ├── items/
│   │       │   └── route.ts        # CRUD API（GET/POST）
│   │       ├── items/[id]/
│   │       │   └── route.ts        # 单条记录 API（PUT/DELETE）
│   │       ├── export/
│   │       │   └── route.ts        # Excel 导出 API
│   │       └── import/
│   │           └── route.ts        # Excel 导入 API
│   ├── components/
│   │   ├── DataTable.tsx           # 数据表格组件
│   │   ├── ImportButton.tsx        # 导入按钮组件
│   │   ├── ExportButton.tsx        # 导出按钮组件
│   │   └── ItemForm.tsx            # 新增/编辑表单组件
│   └── lib/
│       ├── prisma.ts               # Prisma 客户端单例
│       └── excel.ts                # Excel 工具函数
├── prisma/
│   └── schema.prisma               # 数据库模型定义
├── public/                         # 静态资源
├── .env.local                      # 环境变量（本地）
├── next.config.ts                  # Next.js 配置
├── package.json
└── tsconfig.json
```

## 五、数据库模型

以一个通用的"数据项"（Item）为示例，包含常见字段：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Item {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(200)
  category    String?  @db.VarChar(100)
  quantity    Int      @default(0)
  price       Float    @default(0)
  description String?  @db.Text
  status      String   @default("active") @db.VarChar(20)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

> 注意：Vercel Postgres (Neon) 需要同时配置 `DATABASE_URL`（连接池 URL）和 `DIRECT_URL`（直连 URL），Prisma 使用 `directUrl` 执行迁移，使用 `url` 进行日常查询。

## 六、实施步骤

### 步骤 1：初始化 Next.js 项目

* 使用 `npx create-next-app@latest` 创建项目

* 配置 TypeScript、Tailwind CSS、App Router、src 目录

* 安装核心依赖：`prisma`、`@prisma/client`、`xlsx`

### 步骤 2：配置 Prisma + Vercel Postgres

1. 在 Vercel Dashboard → Storage → Create Database → 选择 Postgres → 创建数据库
2. Vercel 自动生成环境变量：`DATABASE_URL`、`DIRECT_URL` 等
3. 将环境变量复制到本地 `.env.local` 文件
4. 运行 `npx prisma init` 初始化 Prisma
5. 编写 `prisma/schema.prisma` 定义 Item 模型（含 directUrl 配置）
6. 创建 `src/lib/prisma.ts` Prisma 客户端单例（使用 globalThis 缓存）
7. 执行 `npx prisma db push` 同步数据库

### 步骤 3：实现后端 API

1. **CRUD API** (`src/app/api/items/route.ts`)

   * `GET /api/items` - 获取所有数据项（支持分页）

   * `POST /api/items` - 新增数据项

2. **单条记录 API** (`src/app/api/items/[id]/route.ts`)

   * `PUT /api/items/[id]` - 更新数据项

   * `DELETE /api/items/[id]` - 删除数据项

3. **Excel 导出 API** (`src/app/api/export/route.ts`)

   * `GET /api/export` - 从数据库查询所有数据，生成 Excel 二进制流返回

   * 使用 `xlsx` 库的 `build()` 方法生成 Buffer

   * 设置正确的响应头（Content-Type、Content-Disposition）

   * 直接返回二进制流，无需写入磁盘

4. **Excel 导入 API** (`src/app/api/import/route.ts`)

   * `POST /api/import` - 接收上传的 Excel 文件

   * 使用 `xlsx` 库解析文件内容为 JSON

   * 批量写入数据库（使用 Prisma 的 `createMany`）

   * 返回导入结果（成功/失败条数）

### 步骤 4：实现前端页面和组件

1. **首页** (`src/app/page.tsx`)

   * 展示数据列表表格

   * 包含导入/导出按钮

   * 支持新增/编辑/删除操作

2. **DataTable 组件** (`src/components/DataTable.tsx`)

   * 展示数据列表

   * 支持删除操作

   * 显示加载状态

3. **ImportButton 组件** (`src/components/ImportButton.tsx`)

   * 文件选择按钮（限制 .xlsx/.xls）

   * 上传文件到 `/api/import`

   * 显示导入进度和结果

4. **ExportButton 组件** (`src/components/ExportButton.tsx`)

   * 点击触发 `/api/export` 下载

   * 使用前端 Blob + URL.createObjectURL 实现下载

5. **ItemForm 组件** (`src/components/ItemForm.tsx`)

   * 新增/编辑表单

   * 字段验证

### 步骤 5：Excel 工具函数

创建 `src/lib/excel.ts`，封装：

* `parseExcelBuffer(buffer)` - 解析 Excel Buffer 为 JSON 数组

* `buildExcelBuffer(data, headers)` - 将 JSON 数组生成 Excel Buffer

* 字段映射（中文表头 ↔ 数据库字段名）

### 步骤 6：Vercel 部署配置

1. 确保 Vercel 项目已关联 GitHub 仓库
2. 在 Vercel Dashboard → Settings → Environment Variables 中确认 `DATABASE_URL` 和 `DIRECT_URL` 已配置
3. 在 `package.json` 中添加 postinstall 脚本：`prisma generate`
4. 推送代码到 GitHub，Vercel 自动构建部署
5. 部署后验证数据库连接和 API 功能

### 步骤 7：测试验证

* 本地测试所有 CRUD 操作

* 测试 Excel 导出（下载数据）

* 测试 Excel 导入（上传数据）

* Vercel 部署后验证线上功能

## 七、Excel 导入导出核心逻辑

### 导出流程

```
用户点击"导出" → 前端请求 GET /api/export → 后端查询数据库全部数据
→ 使用 xlsx.build() 生成 Buffer → 设置响应头 → 返回二进制流 → 前端触发下载
```

### 导入流程

```
用户选择 Excel 文件 → 前端 FormData 上传到 POST /api/import
→ 后端接收文件 → xlsx.read() 解析为 JSON → 字段映射
→ Prisma createMany() 批量插入 → 返回导入结果
```

## 八、关键注意事项

1. **Vercel 文件系统只读**：Excel 导出使用内存 Buffer，不写入磁盘
2. **Prisma 热重载问题**：开发环境使用 globalThis 缓存 PrismaClient 实例
3. **Excel 文件大小限制**：Vercel Serverless 函数 body 限制 4.5MB，需注意大文件导入
4. **数据库连接**：Vercel Postgres (Neon) 使用连接池 URL，避免 Serverless 环境连接耗尽
5. **环境变量**：本地 `.env.local` 和 Vercel 环境变量需同步配置，Neon 需同时配置 `DATABASE_URL` 和 `DIRECT_URL`
6. **Prisma 迁移**：生产环境使用 `prisma migrate deploy`，开发环境使用 `prisma db push`

