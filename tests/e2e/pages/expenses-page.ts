import { expect, type Locator, type Page } from '@playwright/test';
import { path } from '../support/env';

/**
 * Page object for `/expenses`. Uses the stable `data-testid` hooks added for E2E plus
 * the real control ids from the shared transaction form (`#tx-amount`, `#tx-description`),
 * never i18n copy.
 */
export class ExpensesPage {
  private readonly addButton: Locator;
  private readonly saveButton: Locator;
  private readonly amountInput: Locator;
  private readonly descriptionInput: Locator;
  readonly total: Locator;

  constructor(private readonly page: Page) {
    this.addButton = page.getByTestId('add-expense').first();
    this.saveButton = page.getByTestId('transaction-save');
    this.amountInput = page.locator('#tx-amount');
    this.descriptionInput = page.locator('#tx-description');
    this.total = page.getByTestId('expenses-total');
  }

  async goto(): Promise<void> {
    await this.page.goto(path('/expenses'));
    await expect(this.addButton).toBeVisible();
    await expect(this.total).toBeVisible();
  }

  async openDialog(): Promise<void> {
    // The page's "add" button is a menu (type it, say it, scan it), not a direct form opener.
    await this.addButton.click();
    await this.page.getByTestId('quick-add-type').click();
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
    // A row is shown in the ledger and again in the page's "biggest payments" and payee panels,
    // so the lookup is scoped to the list the test actually means.
    return this.page.getByTestId('ledger').getByText(description, { exact: false });
  }
}
