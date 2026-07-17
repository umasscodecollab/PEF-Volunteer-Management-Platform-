import { type Locator, type Page } from '@playwright/test';

export class WorkspacePage {
  readonly page: Page;
  readonly announcementsTabToggle: Locator;
  readonly resourcesTabToggle: Locator;
  
  // Announcement form locators
  readonly titleInput: Locator;
  readonly targetRoleSelect: Locator;
  readonly contentTextarea: Locator;
  readonly publishBtn: Locator;
  
  // Resources locators
  readonly uploadResourceBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.announcementsTabToggle = page.getByRole('button', { name: 'Announcements' });
    this.resourcesTabToggle = page.getByRole('button', { name: 'Resources' });
    
    this.titleInput = page.getByPlaceholder('Announcement Title');
    this.targetRoleSelect = page.locator('select');
    this.contentTextarea = page.getByPlaceholder('Write your announcement here...');
    this.publishBtn = page.getByRole('button', { name: 'Publish Announcement' });
    
    this.uploadResourceBtn = page.getByText('Upload Resource');
  }

  async navigate() {
    await this.page.goto('/workspace');
  }

  async switchTab(tabName: 'Announcements' | 'Resources') {
    if (tabName === 'Announcements') {
      await this.announcementsTabToggle.click();
    } else {
      await this.resourcesTabToggle.click();
    }
  }

  async createAnnouncement(title: string, content: string, targetRole: string) {
    await this.titleInput.fill(title);
    await this.targetRoleSelect.selectOption(targetRole);
    await this.contentTextarea.fill(content);
    await this.publishBtn.click();
  }
}
