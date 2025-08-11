import mongoose, { ConnectOptions, Connection } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI not found");
}

if (!globalThis.mongoose) {
  globalThis.mongoose = { conn: null, promise: null } as {
    conn: Connection | null;
    promise: Promise<Connection> | null;
  };
}

export async function connectDatabase(): Promise<Connection> {
  if (globalThis.mongoose.conn) {
    return globalThis.mongoose.conn;
  }

  if (!globalThis.mongoose.promise) {
    const options: ConnectOptions = {
      bufferCommands: true,
      maxPoolSize: 10,
    } as ConnectOptions;

    globalThis.mongoose.promise = mongoose
      .connect(MONGODB_URI, options)
      .then((mongooseInstance) => mongooseInstance.connection);
  }

  try {
    globalThis.mongoose.conn = await globalThis.mongoose.promise;
  } catch (error) {
    globalThis.mongoose.promise = null;
    throw error;
  }

  return globalThis.mongoose.conn;
}
