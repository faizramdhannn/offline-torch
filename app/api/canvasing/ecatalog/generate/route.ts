import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import jsPDF from 'jspdf';
import sharp from 'sharp';

const TORCH_BLUE = '#0B7A8F';

const COLOR_MAP: Record<string, string> = {
  'black': '#000000', 'grey': '#808080', 'gray': '#808080',
  'dark grey': '#404040', 'dark gray': '#404040',
  'navy': '#000080', 'blue': '#0000FF', 'legion blue': '#1E3A8A',
  'light blue': '#87CEEB', 'green': '#008000', 'olive': '#808000',
  'red': '#FF0000', 'yellow': '#FFFF00', 'pop yellow': '#FFD700',
  'everglade tosca': '#2F7F7F', 'sycamore green': '#8B9467',
  'charcoal grey': '#36454F', 'white': '#FFFFFF',
};

function getColorHex(colorName: string): string {
  return COLOR_MAP[colorName.toLowerCase().trim()] || '#CCCCCC';
}

async function downloadImage(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (attempt < retries) continue;
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      let imageData = new Uint8Array(arrayBuffer);
      const originalSize = imageData.length;
      const originalSizeKB = originalSize / 1024;
      
      // Jika di bawah 500KB, langsung gunakan tanpa kompres
      if (originalSizeKB < 500) {
        const base64 = Buffer.from(imageData).toString('base64');
        const mimeType = url.includes('.png') ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
      }
      
      // Jika lebih dari 500KB, kompres
      let quality = 85;
      
      while (imageData.length > 500000 && quality > 10) {
        try {
          const compressed = await sharp(Buffer.from(imageData))
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
          
          imageData = new Uint8Array(compressed);
          
          if (imageData.length > 500000) {
            quality -= 15;
          } else {
            break;
          }
        } catch (error) {
          break;
        }
      }
      
      const base64 = Buffer.from(imageData).toString('base64');
      const mimeType = 'image/jpeg';
      
      return `data:${mimeType};base64,${base64}`;
      
    } catch (error) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return null;
    }
  }
  
  return null;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export async function POST(request: NextRequest) {
  try {
    const data = await getSheetData('catalog_product');
    
    const products = data.filter((item: any) => 
      item.stock === 'TRUE' && item.artikel && item.category
    );

    // Group by category
    const grouped: Record<string, any[]> = {};
    products.forEach((p: any) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push({
        artikel: p.artikel,
        color: p.color || '',
        onmodel_url: p.onmodel_url || '',
        image_url: p.image_url || '',
      });
    });

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    
    const logo = await downloadImage(
      'https://cdn.shopify.com/s/files/1/1615/1301/files/Untitled_design_162c0ca1-c46e-4635-8f4c-bc44d547ee5e.png?v=1770919047'
    );

    createCover(doc, W, H, logo);
    
    const categories = Object.keys(grouped).sort();
    
    for (const cat of categories) {
      const items = grouped[cat];
      
      doc.addPage();
      createCategoryPage(doc, W, H, cat, logo);
      
      for (let i = 0; i < items.length; i += 5) {
        const batch = items.slice(i, i + 5);
        doc.addPage();
        await createProductPage(doc, W, H, batch, logo);
      }
    }

    const buffer = Buffer.from(doc.output('arraybuffer'));
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Torch_E-Catalog_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating catalog:', error);
    return NextResponse.json({ 
      error: 'Failed to generate catalog',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function createCover(doc: jsPDF, w: number, h: number, logo: string | null) {
  const blue = hexToRgb(TORCH_BLUE);
  
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');
  
  doc.setFillColor(blue.r, blue.g, blue.b);
  doc.rect(0, 0, w, 28, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('E-Catalogue', 10, 18);
  
  if (logo) {
    try { doc.addImage(logo, 'PNG', w - 55, 4, 50, 20); } catch {}
  }
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Product Catalog', w / 2, h / 2, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Official Torch Products', w / 2, h / 2 + 9, { align: 'center' });
}

function createCategoryPage(doc: jsPDF, w: number, h: number, category: string, logo: string | null) {
  const blue = hexToRgb(TORCH_BLUE);
  
  doc.setFillColor(blue.r, blue.g, blue.b);
  doc.rect(0, 0, w, h, 'F');
  
  doc.setFillColor(Math.max(0, blue.r - 20), Math.max(0, blue.g - 20), Math.max(0, blue.b - 20));
  doc.rect(0, 0, w, 28, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('E-Catalogue', 10, 18);
  
  if (logo) {
    try { doc.addImage(logo, 'PNG', w - 55, 4, 50, 20); } catch {}
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(category, w / 2, h / 2, { align: 'center' });
}

async function createProductPage(
  doc: jsPDF, 
  w: number, 
  h: number, 
  products: any[], 
  logo: string | null
) {
  const blue = hexToRgb(TORCH_BLUE);
  
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');
  
  doc.setFillColor(blue.r, blue.g, blue.b);
  doc.rect(0, 0, w, 28, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('E-Catalogue', 10, 18);
  
  if (logo) {
    try { doc.addImage(logo, 'PNG', w - 55, 4, 50, 20); } catch {}
  }
  
  const marginTop = 32;
  const marginBottom = 8;
  const marginLR = 8;
  
  const contentH = h - marginTop - marginBottom;
  const rowHeight = contentH / 5;
  
  const imagePromises = products.slice(0, 5).map(async (p) => {
    const [onmodel, product] = await Promise.all([
      p.onmodel_url ? downloadImage(p.onmodel_url) : null,
      p.image_url ? downloadImage(p.image_url) : null,
    ]);
    return { onmodel, product };
  });
  
  const images = await Promise.all(imagePromises);
  
  for (let i = 0; i < Math.min(products.length, 5); i++) {
    const p = products[i];
    const img = images[i];
    
    const y = marginTop + (i * rowHeight);
    
    if (i > 0) {
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.3);
      doc.line(marginLR, y, w - marginLR, y);
    }
    
    const onmodelW = (w - 2 * marginLR) * 0.25;
    const productW = (w - 2 * marginLR) * 0.35;
    const textW = (w - 2 * marginLR) * 0.40;
    
    const imgH = rowHeight * 0.85;
    const imgY = y + (rowHeight - imgH) / 2;
    
    if (img.onmodel) {
      try {
        doc.addImage(img.onmodel, 'JPEG', marginLR + 2, imgY, imgH, imgH);
      } catch {}
    }
    
    if (img.product) {
      try {
        const centerX = marginLR + onmodelW;
        doc.addImage(img.product, 'JPEG', centerX + 2, imgY, imgH, imgH);
      } catch {}
    }
    
    const textX = marginLR + onmodelW + productW + 4;
    const textY = y + 8;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    const lines = doc.splitTextToSize(p.artikel || 'N/A', textW - 6);
    for (let j = 0; j < Math.min(lines.length, 2); j++) {
      doc.text(lines[j], textX, textY + (j * 5));
    }
    
    if (p.color) {
      const colors = p.color.split(';').map((c: string) => c.trim()).filter(Boolean);
      const colorY = textY + (Math.min(lines.length, 2) * 5) + 7;
      
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text('Warna:', textX, colorY - 1);
      
      for (let k = 0; k < Math.min(colors.length, 4); k++) {
        const rgb = hexToRgb(getColorHex(colors[k]));
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.circle(textX + (k * 6.5) + 3, colorY + 3, 2.2, 'F');
        
        doc.setDrawColor(140, 140, 140);
        doc.setLineWidth(0.15);
        doc.circle(textX + (k * 6.5) + 3, colorY + 3, 2.2, 'S');
      }
    }
  }
}