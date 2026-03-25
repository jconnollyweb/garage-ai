// phoneRouter.js

export function getPhoneContext(number) {
  const map = {
    "+441234560001": { tenant_id: 1, phone_number_id: 1 },
    "+441234560002": { tenant_id: 1, phone_number_id: 2 },
    "+441234560099": { tenant_id: 2, phone_number_id: 3 },
  };

  return map[number] || null;
}