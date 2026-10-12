import mongoose, { Schema, Document } from 'mongoose';

export interface ITodoItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: Date;
}

export interface ITodoList extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  category: string; // 'daily', 'shopping', 'work', 'general'
  items: ITodoItem[];
  createdAt: Date;
  updatedAt: Date;
}

const TodoItemSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date }
}, { _id: false });

const TodoListSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    category: { type: String, default: 'general' },
    items: [TodoItemSchema]
  },
  { timestamps: true }
);

export default mongoose.model<ITodoList>('TodoList', TodoListSchema);
