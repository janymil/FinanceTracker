# TTS Restriction Testing Guide

## ✅ **Implemented Security Measures**

### **1. Transaction-Only Content Filter**
- ✅ Keyword validation for transaction-related terms
- ✅ Money amount pattern detection ($5, 15.50, etc.)
- ✅ Multilingual keyword support (English, Spanish, Slovak)

### **2. Predefined Question Templates**
- ✅ No AI generation of questions (removed OpenAI fallback)
- ✅ Fixed templates for each field (amount, vendor, category, date, type)
- ✅ Language-specific templates

### **3. Session & Context Validation**
- ✅ Session ID format validation (`session_` prefix)
- ✅ Transaction data context requirements
- ✅ 30-minute session timeout
- ✅ Maximum 10 conversation turns limit

### **4. Field Restriction**
- ✅ Only allowed fields: amount, vendor, category, date, type
- ✅ Rejects any other field requests

---

## 🧪 **Test Cases**

### **✅ SHOULD WORK (Transaction-Related)**
```javascript
// Valid inputs that should be accepted:
"I spent 50 dollars at Walmart"
"Bought coffee for 5 euros"
"Pagué 20 soles en el supermercado" (Spanish)
"Minul som 15 eur na benzíne" (Slovak)
"Got salary payment today"
"3.50"
"Starbucks"
"Food category"
```

### **❌ SHOULD BE REJECTED (Non-Transaction)**
```javascript
// Invalid inputs that should be blocked:
"What's the weather today?"
"Tell me a joke"
"How are you doing?"
"What's 2+2?"
"Play music"
"Send email"
"Hello, how can I help?"
"Random conversation text"
```

### **❌ SHOULD BE REJECTED (Invalid Fields)**
```javascript
// API calls with invalid fields:
{ field: "weather" }      // ❌ Not allowed
{ field: "joke" }         // ❌ Not allowed  
{ field: "help" }         // ❌ Not allowed
{ field: "amount" }       // ✅ Allowed
{ field: "vendor" }       // ✅ Allowed
```

### **❌ SHOULD BE REJECTED (Session Issues)**
```javascript
// Invalid session contexts:
{ sessionId: "invalid" }           // ❌ Wrong format
{ sessionId: "session_old_time" }  // ❌ Expired (>30min)
{ turn: 11 }                       // ❌ Too many turns
```

---

## 🔒 **Security Benefits**

1. **Cost Control**: No unlimited AI conversations
2. **Scope Limitation**: Only transaction completion tasks
3. **Abuse Prevention**: No general chatbot functionality  
4. **Session Management**: Automatic timeouts and limits
5. **Resource Protection**: Predefined responses reduce API costs

---

## 📊 **Cost Impact**

| Before Restrictions | After Restrictions |
|---------------------|-------------------|
| Unlimited conversations | Max 10 turns per session |
| AI-generated questions | Predefined templates |
| Any topic allowed | Transaction-only |
| No timeouts | 30-minute sessions |
| **High cost risk** | **Controlled costs** |

---

## 🎯 **Usage Examples**

### **Valid Transaction Flow:**
1. User: *"I bought coffee this morning"*
2. System: *"How much did you spend on coffee?"* (predefined template)
3. User: *"Five dollars"*  
4. System: *"Where did you buy it?"* (predefined template)
5. User: *"Starbucks"*
6. System: *"Perfect! I'll save $5 at Starbucks for coffee."* (predefined confirmation)

### **Blocked Attempts:**
1. User: *"What's the weather?"*
2. System: **Error 400**: *"TTS is restricted to transaction-related content only."*

### **Session Limits:**
1. After 10 exchanges: **Error 400**: *"Conversation limit reached. Please complete manually."*
2. After 30 minutes: **Error 400**: *"Session expired. Please start new session."*