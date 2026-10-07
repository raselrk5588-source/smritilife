import mongoose, { Schema, Document } from 'mongoose';

export interface INote extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  type: string;
  category: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, default: 'General' },
    category: { type: String, default: 'Uncategorized' },
    tags: [{ type: String }],
    pinned: { type: Boolean, default: false },
    favorite: { type: Boolean, default: false },
    archived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<INote>('Note', NoteSchema);
