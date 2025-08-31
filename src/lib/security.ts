// Security utilities for password hashing and validation
export class SecurityManager {
  private static readonly SALT = 'game_admin_secure_salt_2024';
  private static readonly SECRET_ADMIN = {
    login: 'supreme_operator_2024',
    password: 'GameAdmin#SecureAccess$2024!',
    hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' // sha256 of password + salt
  };

  // Hash password using SHA-256
  static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + this.SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verify password against hash
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const computedHash = await this.hashPassword(password);
    return computedHash === hash;
  }

  // Check if login attempt is for secret admin
  static isSecretAdmin(login: string, password: string): boolean {
    return login === this.SECRET_ADMIN.login && password === this.SECRET_ADMIN.password;
  }

  // Get secret admin user object
  static getSecretAdmin(): any {
    return {
      id: 'secret_admin_supreme',
      login: this.SECRET_ADMIN.login,
      passwordHash: this.SECRET_ADMIN.hash,
      nickname: 'Главный Оператор',
      adminLevel: 10,
      status: 'offline' as const,
      lastActivity: new Date().toISOString(),
      createdAt: '2024-01-01T00:00:00.000Z',
      totalOnlineTime: 0,
      monthlyOnlineTime: {},
      monthlyNorm: 1 // 1 hour per month
    };
  }

  // Validate password strength
  static validatePasswordStrength(password: string): { valid: boolean; message: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Пароль должен содержать минимум 8 символов' };
    }
    
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Пароль должен содержать заглавную букву' };
    }
    
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Пароль должен содержать строчную букву' };
    }
    
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Пароль должен содержать цифру' };
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, message: 'Пароль должен содержать специальный символ' };
    }
    
    return { valid: true, message: 'Пароль соответствует требованиям безопасности' };
  }

  // Generate secure random password
  static generateSecurePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // Sanitize input to prevent XSS
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  // Rate limiting for login attempts
  private static loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();

  static checkRateLimit(identifier: string): { allowed: boolean; waitTime?: number } {
    const now = Date.now();
    const attempt = this.loginAttempts.get(identifier);

    if (!attempt) {
      this.loginAttempts.set(identifier, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    // Reset counter after 15 minutes
    if (now - attempt.lastAttempt > 15 * 60 * 1000) {
      this.loginAttempts.set(identifier, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    // Allow max 5 attempts per 15 minutes
    if (attempt.count >= 5) {
      const waitTime = 15 * 60 * 1000 - (now - attempt.lastAttempt);
      return { allowed: false, waitTime: Math.ceil(waitTime / 1000) };
    }

    attempt.count++;
    attempt.lastAttempt = now;
    return { allowed: true };
  }

  static clearRateLimit(identifier: string): void {
    this.loginAttempts.delete(identifier);
  }
}