import type { Order } from "@/modules/orders/order.types";

/**
 * Mock order seed. Also the source the seed script loads into Mongo. Orders are
 * historical snapshots (item name/image/price are stored inline), so the seed
 * `productId`/`customerId` are legacy demo references — new orders created via
 * the app use real ObjectIds.
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const orders: Order[] = [
  {
    id: "ord_seed_1",
    orderNumber: "NK-2026-1042",
    customerId: "cus_seed_1",
    customer: { name: "Ananya Sharma", email: "ananya@example.com", phone: "+91 90000 11111" },
    items: [
      {
        productId: "p1",
        name: "Royal Ruby Signet Ring",
        image:
          "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
        sku: "NK-RUBY-001",
        unitPrice: 42999,
        qty: 1,
        lineTotal: 42999,
      },
    ],
    pricing: { subtotal: 42999, discount: 0, shipping: 0, tax: 1290, grandTotal: 44289 },
    shippingAddress: {
      name: "Ananya Sharma",
      phone: "+91 90000 11111",
      line1: "12 Residency Road",
      city: "Jaipur",
      state: "Rajasthan",
      postalCode: "302001",
      country: "India",
    },
    status: "shipped",
    paymentStatus: "paid",
    paymentMethod: "upi",
    fulfillment: { courier: "BlueDart", trackingNumber: "BD123456789", shippedAt: daysAgo(2) },
    activity: [
      { id: "oa1", at: daysAgo(2), type: "fulfillment", message: "Shipped via BlueDart (BD123456789)", actor: "Admin" },
      { id: "oa2", at: daysAgo(5), type: "status", message: "Status changed to confirmed", actor: "Admin" },
      { id: "oa3", at: daysAgo(6), type: "created", message: "Order placed", actor: "System" },
    ],
    placedAt: daysAgo(6),
    updatedAt: daysAgo(2),
  },
  {
    id: "ord_seed_2",
    orderNumber: "NK-2026-0988",
    customerId: "cus_seed_2",
    customer: { name: "Rohan Mehta", email: "rohan@example.com", phone: "+91 98888 22222" },
    items: [
      {
        productId: "p2",
        name: "Celestial Blue Sapphire Ring",
        image:
          "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&q=80",
        unitPrice: 68999,
        qty: 1,
        lineTotal: 68999,
      },
    ],
    pricing: { subtotal: 68999, discount: 5000, couponCode: "WELCOME5K", shipping: 0, tax: 1920, grandTotal: 65919 },
    shippingAddress: {
      name: "Rohan Mehta",
      line1: "4th Floor, Nirmal Tower",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400021",
      country: "India",
    },
    status: "pending",
    paymentStatus: "unpaid",
    paymentMethod: "cod",
    fulfillment: {},
    activity: [{ id: "ob1", at: daysAgo(1), type: "created", message: "Order placed", actor: "System" }],
    placedAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];
