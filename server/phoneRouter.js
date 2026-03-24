// phoneRouter.js

export function getPhoneContext(number) {
  const map = {
    "+441234560001": { tenant_id: 1, phone_number_id: 1 },
    "+441234560002": { tenant_id: 1, phone_number_id: 2 },
  };

  return map[number] || null;
}