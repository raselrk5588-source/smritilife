import { GoogleGenerativeAI } from '@google/generative-ai';
import { IFacebookPage } from '../models/FacebookPage';

// In-memory conversation history & pending order context (TTL 30 mins)
interface ICustomerContext {
  history: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>;
  pendingOrder?: {
    productName?: string;
    quantity?: number;
    price?: number;
    color?: string;
    size?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    deliveryCharge?: number;
    totalAmount?: number;
  };
  lastActive: number;
}

const customerContextMap = new Map<string, ICustomerContext>();

// Clean expired context every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ctx] of customerContextMap.entries()) {
    if (now - ctx.lastActive > 30 * 60 * 1000) {
      customerContextMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

export interface IMessengerAiResult {
  replyText: string;
  orderAction?: {
    isConfirmed: boolean;
    productName: string;
    quantity: number;
    price: number;
    color?: string;
    size?: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryCharge: number;
    totalAmount: number;
  };
}

export const processMessengerCustomerMessage = async (
  page: IFacebookPage,
  senderPsid: string,
  customerMessage: string
): Promise<IMessengerAiResult> => {
  const cleanMsg = (customerMessage || '').trim();
  if (!cleanMsg) {
    return {
      replyText: 'আসসালামু আলাইকুম! আপনাকে কীভাবে সাহায্য করতে পারি বলুন?'
    };
  }

  // Get or initialize conversation context
  const contextKey = `${page.pageId}_${senderPsid}`;
  if (!customerContextMap.has(contextKey)) {
    customerContextMap.set(contextKey, {
      history: [],
      lastActive: Date.now()
    });
  }
  const customerCtx = customerContextMap.get(contextKey)!;
  customerCtx.lastActive = Date.now();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      replyText: 'আসসালামু আলাইকুম! আমাদের পেজে স্বাগতম। কিছুক্ষণের মধ্যে আমাদের প্রতিনিধি আপনার সাথে যোগাযোগ করবেন।'
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Format Products for Prompt
  let productCatalogText = 'বর্তমানে কোনো পণ্য তালিকাভুক্ত নেই।';
  if (page.products && page.products.length > 0) {
    productCatalogText = page.products.map((p, idx) => {
      const stockStr = p.inStock ? 'স্টকে আছে' : 'স্টক শেষ';
      const colorsStr = p.colors && p.colors.length > 0 ? `কালার: ${p.colors.join(', ')}` : '';
      const sizesStr = p.sizes && p.sizes.length > 0 ? `সাইজ: ${p.sizes.join(', ')}` : '';
      return `${idx + 1}. নাম: "${p.name}" | মূল্য: ৳${p.price} | ক্যাটাগরি: ${p.category || 'General'} | স্ট্যাটাস: ${stockStr} ${colorsStr ? '| ' + colorsStr : ''} ${sizesStr ? '| ' + sizesStr : ''} ${p.description ? '| বিবরণ: ' + p.description : ''}`;
    }).join('\n');
  }

  const settings = page.settings;
  const insideDhaka = settings.deliveryChargeInsideDhaka ?? 70;
  const outsideDhaka = settings.deliveryChargeOutsideDhaka ?? 130;

  const systemInstruction = `You are a courteous, natural, helpful, and high-converting AI Sales Representative for "${settings.businessName}" on Facebook Messenger.
Your goal is to answer customer questions politely in natural, conversational Bengali (বাংলা), guide them to purchase products from the catalog, and securely collect and confirm their orders.

### SHOP INFORMATION & POLICIES:
- Shop / Brand Name: ${settings.businessName}
- Delivery Charges: Dhaka Inside: ৳${insideDhaka}, Dhaka Outside / Whole Bangladesh: ৳${outsideDhaka}.
- Cash on Delivery (COD): ${settings.codAvailable ? 'উপলব্ধ (Available)' : 'অনুপলব্ধ'}
- bKash Payment: ${settings.bkashNumber ? 'নম্বর: ' + settings.bkashNumber : 'উপলব্ধ নয়'}
- Contact Phone: ${settings.contactPhone || 'N/A'}
- Merchant Custom Instructions: ${settings.customPromptInstructions || 'N/A'}

### PRODUCT CATALOG:
${productCatalogText}

### CONVERSATION & SALES RULES:
1. Always be polite, respectful, and friendly. Address the customer as "আপনি / ভাইয়া / আপু".
2. Answer inquiries about product price, colors, sizes, stock, and delivery clearly.
3. If customer asks for something not in the catalog, politely say it is currently unavailable and suggest available products.
4. When customer wants to buy/order a product:
   - Confirm which product, color, and size (if applicable) and quantity (default 1).
   - Check if delivery is inside Dhaka (৳${insideDhaka}) or outside Dhaka (৳${outsideDhaka}).
   - Required Customer Details to complete order:
     a) Full Name (গ্রাহকের নাম)
     b) Mobile Number (১১ ডিজিটের সচল ফোন নম্বর 01XXXXXXXXX)
     c) Full Delivery Address (বাসা, রোড, এলাকা/থানা এবং জেলা)
   - If any of these 3 details are missing, politely ask ONLY for the missing details in a friendly manner.
   - Once all 3 details (Name, Phone, Address) + Product are known:
     * Present a clean, beautiful Order Summary (পণ্য, মূল্য, ডেলিভারি চার্জ, মোট টাকা, নাম, ফোন, ঠিকানা).
     * Ask the customer to confirm: "অর্ডারটি কনফার্ম করতে 'হ্যাঁ কনফার্ম' লিখে জানান।"
5. When customer confirms (e.g. "হ্যাঁ", "confirm", "yes", "অর্ডার কনফার্ম", "পাঠিয়ে দাও"):
   - Set "isConfirmed": true in orderAction.
   - Reply with a warm congratulatory message informing them their order is confirmed!

### REQUIRED OUTPUT FORMAT:
You MUST respond with ONLY a valid raw JSON object (NO markdown backticks, NO \`\`\`json):
{
  "replyText": "বাংলায় গ্রাহককে পাঠানোর বার্তা",
  "orderAction": {
    "isConfirmed": false, // set true ONLY when customer explicitly confirms the order summary
    "productName": "পণ্যের নাম",
    "quantity": 1,
    "price": 1200,
    "color": "Black",
    "size": "XL",
    "customerName": "গ্রাহকের নাম",
    "customerPhone": "017XXXXXXXX",
    "deliveryAddress": "সম্পূর্ণ ঠিকানা",
    "deliveryCharge": 70,
    "totalAmount": 1270
  }
}
If customer is just chatting or asking questions, omit "orderAction" or set it to null.`;

  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.5-flash'
  ];

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.2
        }
      });

      const trimmedHistory = customerCtx.history.length > 6 ? customerCtx.history.slice(-6) : customerCtx.history;
      const chat = model.startChat({ history: trimmedHistory });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout waiting for ${modelName}`)), 7000)
      );

      const result: any = await Promise.race([
        chat.sendMessage(cleanMsg),
        timeoutPromise
      ]);

      const responseText = result.response.text().trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      // Save history
      customerCtx.history.push({ role: 'user', parts: [{ text: cleanMsg }] });
      customerCtx.history.push({ role: 'model', parts: [{ text: parsed.replyText || cleanJson }] });
      if (customerCtx.history.length > 8) {
        customerCtx.history = customerCtx.history.slice(-8);
      }

      // Check if orderAction is present and valid
      let orderAction: any = undefined;
      if (parsed.orderAction && parsed.orderAction.productName && parsed.orderAction.customerPhone) {
        orderAction = {
          isConfirmed: !!parsed.orderAction.isConfirmed,
          productName: parsed.orderAction.productName,
          quantity: parseInt(parsed.orderAction.quantity, 10) || 1,
          price: parseFloat(parsed.orderAction.price) || 0,
          color: parsed.orderAction.color || '',
          size: parsed.orderAction.size || '',
          customerName: parsed.orderAction.customerName || 'সম্মানিত গ্রাহক',
          customerPhone: parsed.orderAction.customerPhone || '',
          deliveryAddress: parsed.orderAction.deliveryAddress || '',
          deliveryCharge: parseFloat(parsed.orderAction.deliveryCharge) || insideDhaka,
          totalAmount: parseFloat(parsed.orderAction.totalAmount) || (parseFloat(parsed.orderAction.price) + insideDhaka)
        };
      }

      return {
        replyText: parsed.replyText || 'ধন্যবাদ! আপনার বার্তাটি পেয়েছি। কীভাবে সাহায্য করতে পারি বলুন?',
        orderAction
      };
    } catch (err: any) {
      console.warn(`[MessengerAI] Model ${modelName} error:`, err.message || err);
    }
  }

  // Graceful fallback
  return {
    replyText: 'আসসালামু আলাইকুম! আমাদের সাথে যোগাযোগ করার জন্য ধন্যবাদ। কিছুক্ষণের মধ্যেই আমাদের একজন সেলস এক্সিকিউটিভ আপনার সাথে চ্যাটে যুক্ত হবেন। 😊'
  };
};
