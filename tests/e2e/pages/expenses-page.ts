import { expect, type Locator, type Page } from '@playwright/test';
import { path } from '../support/env';

/**
 * Page object for `/expenses`. Uses the stable `data-testid` hooks added for E2E plus
 * the real control ids from the form (`#amount`, `#description`), never i18n copy.
 */
export class ExpensesPage {
  private readonly addButton: Locator;
  private readonly saveButton: Locator;
  private readonly amountInput: Locator;
  private readonly descriptionInput: Locator;
  readonly total: Locator;

  constructor(private readonly page: Page) {
    this.addButton = page.getByTestId('add-expense').first();
    this.saveButton = page.getByTestId('save-expense');
    this.amountInput = page.locator('#amount');
    this.descriptionInput = page.locator('#description');
    this.total = page.getByTestId('expenses-total');
  }

  async goto(): Promise<void> {
    await this.page.goto(path('/expenses'));
    await expect(this.addButton).toBeVisible();
    await expect(this.total).toBeVisible();
  }

  async openDialog(): Promise<void> {
    await this.addButton.click();
    await expect(this.amountInput).toBeVisible();
  }

  async fillExpense({ amount, description }: { amount: string; description: string }): Promise<void> {
    await this.amountInput.fill(amount);
    await this.descriptionInput.fill(description);
    await expect(this.saveButton).toBeEnabled();
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async addExpense(input: { amount: string; description: string }): Promise<void> {
    await this.openDialog();
    await this.fillExpense(input);
    await this.save();
  }

  transactionRow(description: string): Locator {
    return this.page.getByText(description, { exact: false });
  }
}
