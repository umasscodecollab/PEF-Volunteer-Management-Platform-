import { type Locator, type Page } from '@playwright/test';

export class KioskScannerPage {
  readonly page: Page;
  
  // Kiosk (/kiosk/[id]) locators
  readonly qrCodeElement: Locator;
  readonly checkInList: Locator;
  
  // Scanner (/scanner) locators
  readonly startScannerBtn: Locator;
  readonly successStateIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Kiosk locators
    this.qrCodeElement = page.locator('svg').filter({ has: page.locator('path') }).first(); // Generic SVG QR code assumption
    this.checkInList = page.locator('.check-in-list'); // Fallback class
    
    // Scanner locators
    this.startScannerBtn = page.getByRole('button', { name: 'Tap to Start Scanner' });
    this.successStateIndicator = page.locator('text=Successfully Checked In'); // Adjust based on actual success message
  }

  async startScanner() {
    await this.startScannerBtn.click();
  }

  getLatestCheckIn(): Locator {
    return this.checkInList.locator('div').first();
  }

  verifySuccessState(): Locator {
    return this.successStateIndicator;
  }
}
