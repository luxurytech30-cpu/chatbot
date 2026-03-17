import mongoose from "mongoose";

const cached = globalThis.__mongoose || {
  conn: null,
  promise: null,
};

globalThis.__mongoose = cached;

export async function dbConnect() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;

  if (!mongoUrl) {
    throw new Error("MONGO_URL or MONGODB_URI is missing");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUrl);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
