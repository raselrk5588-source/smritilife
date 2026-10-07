import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig: any = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

if (process.env.REDIS_HOST && process.env.REDIS_HOST.includes('upstash.io')) {
  redisConfig.tls = { rejectUnauthorized: false };
}

export const connection = new Redis(redisConfig);
