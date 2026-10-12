import mongoose, { Schema, Document } from 'mongoose';

export interface IAITrainingRule extends Document {
  rule: string;             // The instruction / rule text
  exampleInput?: string;    // Optional example user input
  exampleOutput?: string;   // Optional example AI JSON/action output
  category?: string;        // 'general' | 'reminder' | 'wish' | 'greeting'
  addedBy?: string;         // WhatsApp number or 'Admin'
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AITrainingRuleSchema: Schema = new Schema(
  {
    rule: { type: String, required: true },
    exampleInput: { type: String, default: '' },
    exampleOutput: { type: String, default: '' },
    category: { type: String, default: 'general' },
    addedBy: { type: String, default: 'Admin' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model<IAITrainingRule>('AITrainingRule', AITrainingRuleSchema);
