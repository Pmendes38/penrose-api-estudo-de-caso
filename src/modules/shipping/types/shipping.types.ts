export interface ShippingCompany { name: string; code?: string }
export interface ShippingQuote {
  id: string;
  name: string;
  company: ShippingCompany;
  priceBRL: number;
  deliveryDays: number;
  description?: string;
  etaDate?: string;
  isFree?: boolean;
}