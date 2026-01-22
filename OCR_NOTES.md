# OCR Implementation Notes

## Current Status: NOT IMPLEMENTED

Dalam requirement disebutkan:
> "jika bisa. ketika upload file itu ada scan dulu dan melihat nominal yang dimasukan itu sesuai tidak dengan foto yang di upload. karna yang diupload itu bon belanja. jika tidak 100% akurat jangan ditampilkan"

**Decision**: Feature ini ditunda untuk v0.3.0 karena kompleksitas tinggi.

## Why Not Implemented Yet?

1. **Complexity**: OCR untuk Indonesian receipts memerlukan:
   - Preprocessing image (rotation, contrast, noise reduction)
   - Text extraction dengan high accuracy
   - Number parsing dari berbagai format
   - Handling berbagai jenis struk/bon
   - Dealing dengan blur, lighting issues, dll

2. **Cost**: OCR APIs yang reliable (Google Vision, AWS Textract) berbayar

3. **Accuracy**: Indonesian receipts sangat bervariasi:
   - Different fonts
   - Different formats
   - Different quality
   - Numbers bisa di posisi berbeda
   - "Total" label varies (Total, Grand Total, Jumlah, dll)

4. **User Experience**: "jika tidak 100% akurat jangan ditampilkan" → terlalu strict
   - Most OCR tidak 100% accurate
   - Users mungkin frustrated jika entry sering ditolak

## Recommended Approach for v0.3.0

### Option 1: Google Cloud Vision API (Recommended)
```typescript
import vision from '@google-cloud/vision';

async function verifyReceiptAmount(imageBuffer: Buffer, expectedAmount: number) {
  const client = new vision.ImageAnnotatorClient();
  
  const [result] = await client.textDetection(imageBuffer);
  const detections = result.textAnnotations;
  
  if (!detections || detections.length === 0) {
    return { valid: false, reason: 'No text detected' };
  }
  
  const fullText = detections[0].description || '';
  
  // Extract numbers
  const numbers = fullText.match(/\d[\d.,\s]*\d/g) || [];
  
  // Find largest number (likely to be total)
  const amounts = numbers.map(n => {
    const cleaned = n.replace(/[.,\s]/g, '');
    return parseInt(cleaned);
  }).filter(n => !isNaN(n));
  
  const maxAmount = Math.max(...amounts);
  
  // Allow 5% tolerance
  const tolerance = expectedAmount * 0.05;
  const difference = Math.abs(maxAmount - expectedAmount);
  
  if (difference <= tolerance) {
    return { 
      valid: true, 
      detectedAmount: maxAmount,
      confidence: 1 - (difference / expectedAmount)
    };
  }
  
  return { 
    valid: false, 
    reason: `Amount mismatch: Expected ${expectedAmount}, found ${maxAmount}`,
    detectedAmount: maxAmount
  };
}
```

**Pros**:
- High accuracy
- Supports Indonesian text
- Handles various receipt formats
- Same Google Cloud account

**Cons**:
- Cost: $1.50 per 1000 images
- Requires additional API setup

### Option 2: Tesseract.js (Free, Open Source)
```typescript
import Tesseract from 'tesseract.js';

async function verifyReceiptWithTesseract(imageBuffer: Buffer, expectedAmount: number) {
  const result = await Tesseract.recognize(imageBuffer, 'ind');
  
  const text = result.data.text;
  const numbers = text.match(/\d[\d.,\s]*\d/g) || [];
  
  // Similar processing as Google Vision
  // ...
}
```

**Pros**:
- Free
- No API limits
- Runs locally

**Cons**:
- Lower accuracy than Google Vision
- Slower processing
- Requires preprocessing for good results

### Option 3: Hybrid Approach (Recommended for Production)

**Stage 1: Client-side Pre-validation**
```typescript
// In the Add Entry modal, show preview of uploaded image
// Allow user to confirm amount is visible
// Warn if image quality looks poor
```

**Stage 2: Optional OCR Verification**
```typescript
// Make OCR optional, not mandatory
// If OCR enabled:
//   - Run verification
//   - Show confidence score
//   - Allow user to override if needed
// If OCR disabled:
//   - Just trust user input
//   - Flag for manual review later
```

**Stage 3: Manual Review Queue**
```typescript
// For admin users with registration_request = TRUE
// Show entries that need verification:
//   - OCR failed
//   - Low confidence
//   - Amount mismatch
// Admin can approve/reject with notes
```

## Implementation Plan for v0.3.0

### Phase 1: Image Quality Check (Week 1)
- [ ] Add client-side image preview
- [ ] Check image dimensions (min 800x600)
- [ ] Check file size (warn if too small/large)
- [ ] Show image quality warnings

### Phase 2: Basic OCR (Week 2-3)
- [ ] Setup Google Cloud Vision API
- [ ] Implement text detection
- [ ] Extract numbers from text
- [ ] Find likely total amount
- [ ] Compare with user input

### Phase 3: Smart Validation (Week 4)
- [ ] Add tolerance settings (default 5%)
- [ ] Handle edge cases (multiple totals, taxes, etc)
- [ ] Add confidence scoring
- [ ] Allow user override with reason

### Phase 4: Review System (Week 5)
- [ ] Create verification_queue sheet
- [ ] Add admin review page
- [ ] Implement approve/reject workflow
- [ ] Add verification history

### Phase 5: Settings & Configuration (Week 6)
- [ ] Add OCR enable/disable setting
- [ ] Configure tolerance percentage
- [ ] Set auto-approve threshold
- [ ] Email notifications for review queue

## Cost Estimation

**For 100 entries/month with OCR:**
- Google Vision: $0.15/month
- Storage: Negligible
- **Total: ~$0.20/month**

**For 1000 entries/month with OCR:**
- Google Vision: $1.50/month
- Storage: ~$0.05/month
- **Total: ~$1.60/month**

## Alternative: Manual Verification Only

Instead of OCR, implement simpler manual verification:

1. **Photo Preview**: Show uploaded photo next to input fields
2. **Double Entry**: User enters amount twice to confirm
3. **Random Audits**: Admin reviews random 10% of entries
4. **Anomaly Detection**: Flag unusually high amounts
5. **Trust Score**: Track user accuracy over time

**Benefits**:
- No OCR cost
- Simpler to implement
- No false rejections
- Faster processing

**Drawbacks**:
- Less automated
- Requires trust
- Manual review overhead

## Recommendation

For v0.2.0 (Current):
- ✅ **Skip OCR** - Too complex for initial release
- ✅ Implement photo upload and storage
- ✅ Allow manual verification by admins

For v0.3.0 (Next):
- 🎯 **Implement Hybrid Approach**
- Start with image quality checks
- Add optional Google Vision OCR
- Build review queue for admins
- Make OCR opt-in, not mandatory

For v1.0.0 (Future):
- 🚀 **Full OCR Pipeline**
- Automatic verification
- ML model for receipt parsing
- High confidence auto-approval
- Low confidence manual review

## Related Files to Create in v0.3.0

```
lib/
  ocr.ts              # OCR logic
  image-processing.ts # Preprocessing
  validation.ts       # Amount validation

app/api/
  verify-receipt/     # OCR endpoint
  review-queue/       # Admin review

app/
  verification/       # Review page for admins

components/
  ImagePreview.tsx    # Show uploaded image
  AmountVerifier.tsx  # OCR result display
```

## Testing Strategy

1. **Test Dataset**: Collect 100 real receipt samples
2. **Accuracy Benchmark**: Measure OCR accuracy
3. **Performance**: Test processing time
4. **Edge Cases**: Blur, rotation, poor lighting
5. **User Testing**: Get feedback on UX

## Notes

- Current implementation is complete WITHOUT OCR
- Users can still upload and use system normally
- OCR is a nice-to-have, not a must-have
- Can be added later without breaking changes
- Focus on core features first ✅
