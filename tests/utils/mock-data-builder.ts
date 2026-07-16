export type UserRole = 'Volunteer' | 'Center Lead' | 'Admin';

export function generateTestUser(role: UserRole) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  const normalizedRole = role.toLowerCase().replace(/\s+/g, '_');
  
  const email = `testuser_${normalizedRole}_${timestamp}_${randomStr}@example.com`;
  const password = 'StrongTestPassword123!';
  
  return {
    email,
    password,
    role
  };
}
