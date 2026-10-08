# Docker Setup untuk CP-Platform

Panduan lengkap untuk menjalankan CP-Platform menggunakan Docker dan Docker Compose.

## Prasyarat

- Docker Desktop terinstal (atau Docker Engine + Docker Compose)
- Node.js 20+ (untuk development lokal)
- Supabase CLI (untuk development dengan database lokal)

## Quick Start

### 1. Siapkan Environment Variables

```bash
# Copy file contoh
cp .env.docker.example .env.local

# Edit .env.local dengan nilai Supabase Anda
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Build dan Jalankan dengan Docker Compose

```bash
# Build image
docker-compose build

# Jalankan container
docker-compose up -d

# Lihat logs
docker-compose logs -f app
```

Aplikasi akan tersedia di `http://localhost:3000`

### 3. Hentikan Container

```bash
docker-compose down
```

## Development Workflow

### Opsi 1: Menggunakan Supabase CLI (Recommended)

```bash
# Terminal 1: Jalankan Supabase lokal
supabase start

# Terminal 2: Jalankan aplikasi dengan npm
npm run dev
```

Atau dengan Docker:

```bash
# Terminal 1: Jalankan Supabase lokal
supabase start

# Terminal 2: Jalankan container
docker-compose up
```

### Opsi 2: Menggunakan PostgreSQL dalam Docker

Jika ingin database dalam Docker, uncomment service `db` di `docker-compose.yml`:

```yaml
db:
  image: postgres:16-alpine
  # ... (uncomment seluruh service)
```

Kemudian update `.env.local`:
```
DATABASE_URL=postgresql://postgres:postgres@db:5432/cp_platform
```

## Build Manual

Jika ingin build dan menjalankan image secara manual:

```bash
# Build image
docker build -t cp-platform:latest .

# Jalankan container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  cp-platform:latest
```

## Production Deployment

### Docker Registry (e.g., Docker Hub, GitHub Container Registry)

```bash
# Login ke registry
docker login

# Build dengan tag
docker build -t your-username/cp-platform:1.0.0 .

# Push ke registry
docker push your-username/cp-platform:1.0.0

# Pull dan jalankan di server
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_SUPABASE_URL=<production-url> \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-key> \
  your-username/cp-platform:1.0.0
```

### Docker Compose untuk Production

```bash
# Build dengan production env
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Port sudah digunakan

```bash
# Ubah port di docker-compose.yml
ports:
  - "3001:3000"  # Host:Container

# Atau hentikan service yang menggunakan port
lsof -i :3000
kill -9 <PID>
```

### Container tidak berjalan

```bash
# Cek logs
docker-compose logs app

# Rebuild dari awal
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Environment variables tidak terbaca

Pastikan `.env.local` ada di root directory dan format benar:
```
KEY=value  # tidak ada spasi sebelum =
```

## File-file Docker

- **Dockerfile**: Multi-stage build untuk production image
- **docker-compose.yml**: Orchestration untuk development dan production
- **.dockerignore**: File/folder yang tidak di-copy ke image
- **.env.docker.example**: Template environment variables

## Struktur Dockerfile

```
Stage 1 (Builder):
- Install dependencies
- Build Next.js app

Stage 2 (Runtime):
- Copy hanya production dependencies
- Copy built app dan public folder
- Expose port 3000
- Health check
- Start aplikasi
```

Ini mengoptimalkan final image size dengan hanya menyertakan yang diperlukan untuk production.

## Tips & Best Practices

1. **Development**: Gunakan `npm run dev` untuk hot-reload, Docker lebih cocok untuk testing production build
2. **Environment Variables**: Jangan commit `.env.local`, selalu gunakan `.env.example`
3. **Image Size**: Gunakan Alpine Linux (20-alpine) untuk image kecil
4. **Security**: Jalankan container dengan non-root user jika memungkinkan
5. **Health Check**: Image sudah include health check endpoint
6. **Performance**: Multi-stage build mengurangi final image size ~70%

## Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
