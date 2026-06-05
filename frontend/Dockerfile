FROM node:20-alpine

WORKDIR /app

# คัดลองไฟล์ dependency เพื่อทำ layer caching
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# คัดลองโค้ดทั้งหมด
COPY . .

EXPOSE 5173

# รัน Vite dev server โดยเปิด host ให้ Docker เข้าถึงได้
CMD ["yarn", "dev", "--host", "0.0.0.0"]