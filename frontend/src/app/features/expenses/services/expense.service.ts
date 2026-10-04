import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { AccountHead, ChurchExpenseTransaction, MonthlyAccountsResponse, MonthlyAbstract } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/expenses`;

  // Account Heads
  getAccountHeads(type?: 'receipt' | 'payment'): Observable<AccountHead[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    return this.http
      .get<ApiResponse<AccountHead[]>>(`${this.baseUrl}/heads`, { params })
      .pipe(map((res) => res.data));
  }

  createAccountHead(data: Partial<AccountHead>): Observable<AccountHead> {
    return this.http
      .post<ApiResponse<AccountHead>>(`${this.baseUrl}/heads`, data)
      .pipe(map((res) => res.data));
  }

  updateAccountHead(id: number, data: Partial<AccountHead>): Observable<AccountHead> {
    return this.http
      .put<ApiResponse<AccountHead>>(`${this.baseUrl}/heads/${id}`, data)
      .pipe(map((res) => res.data));
  }

  deleteAccountHead(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/heads/${id}`)
      .pipe(map((res) => res.data?.success ?? true));
  }

  // Monthly Ledger & Abstract
  getMonthlyAccounts(monthYear: string, branchId?: number | null): Observable<MonthlyAccountsResponse> {
    let params = new HttpParams().set('monthYear', monthYear);
    if (branchId) {
      params = params.set('branchId', String(branchId));
    }
    return this.http
      .get<ApiResponse<MonthlyAccountsResponse>>(`${this.baseUrl}/monthly`, { params })
      .pipe(map((res) => res.data));
  }

  saveMonthlyLedger(
    monthYear: string,
    payload: { entries: any[]; abstract: Partial<MonthlyAbstract> },
    branchId?: number | null
  ): Observable<boolean> {
    const body = {
      monthYear,
      branchId: branchId || null,
      entries: payload.entries,
      abstract: payload.abstract,
    };
    return this.http
      .post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/monthly/save`, body)
      .pipe(map((res) => res.data?.success ?? true));
  }

  getMonthlyPrintPdfBlob(monthYear: string, branchId?: number | null): Observable<Blob> {
    let params = new HttpParams().set('monthYear', monthYear);
    if (branchId) {
      params = params.set('branchId', String(branchId));
    }
    return this.http.get(`${this.baseUrl}/monthly/print`, {
      params,
      responseType: 'blob',
    });
  }

  // Transactions
  listTransactions(query: {
    dateFrom?: string;
    dateTo?: string;
    type?: string;
    headId?: number;
    page?: number;
    limit?: number;
    branchId?: number | null;
  }): Observable<{ rows: ChurchExpenseTransaction[]; total: number; page: number; limit: number }> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params = params.set(key, String(val));
      }
    });
    return this.http
      .get<ApiResponse<{ rows: ChurchExpenseTransaction[]; total: number; page: number; limit: number }>>(
        `${this.baseUrl}/transactions`,
        { params }
      )
      .pipe(map((res) => res.data));
  }

  createTransaction(data: {
    entryDate: string;
    type: 'receipt' | 'payment';
    headId?: number | null;
    headName: string;
    amount: number;
    paymentMethodId?: number | null;
    voucherNo?: string | null;
    paidTo?: string | null;
    notes?: string | null;
    branchId?: number | null;
  }): Observable<ChurchExpenseTransaction> {
    return this.http
      .post<ApiResponse<ChurchExpenseTransaction>>(`${this.baseUrl}/transactions`, data)
      .pipe(map((res) => res.data));
  }

  deleteTransaction(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/transactions/${id}`)
      .pipe(map((res) => res.data?.success ?? true));
  }
}
