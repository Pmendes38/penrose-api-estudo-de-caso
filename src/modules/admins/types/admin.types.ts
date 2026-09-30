export type AdminRole = 'admin';

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminDoc extends Admin {
  password: string;
}

export type AdminSafe = Omit<Admin, 'password'>;
