# Internal Server Deployment Guide

## Option 1: Windows Server (IIS)
1. Install Node.js on Windows Server
2. Build the app: `npm run build`
3. Copy files to IIS wwwroot
4. Configure IIS to serve Next.js app
5. Access via internal domain: http://cvapp.company.local

## Option 2: Docker Container
1. Create Dockerfile:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

2. Build and run:
```bash
docker build -t cv-screening-app .
docker run -p 3000:3000 cv-screening-app
```

## Option 3: Simple HTTP Server
1. Build the app: `npm run build`
2. Start production server: `npm start`
3. Access at: http://server-ip:3000

## Network Configuration
- Configure firewall to allow port 3000
- Set up internal DNS: cvapp.company.local → server-ip:3000
- Optional: Use reverse proxy (nginx/Apache) for port 80/443