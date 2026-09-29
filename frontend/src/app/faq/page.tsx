import Link from "next/link";
const faqs = [
  ["Can I place an order without creating an account?", "Yes. You can check out as a guest and choose to create an account after placing your order."],
  ["Is store pickup available?", "Yes. Select store pickup at checkout and we will update you when your order is ready to collect."],
  ["Can I order return gifts in bulk?", "Yes. Send us the occasion, quantity and preferred budget, and our team will help you choose a suitable return-gift pack."],
  ["How do online payments work?", "Secure online payments are processed through Razorpay. Available payment methods are shown during checkout."],
  ["Can I request a product that is not listed?", "The support page can be used for product enquiries. Availability will be confirmed by the store."],
];
export default function FaqPage() { return <><section className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>FAQ</span></div><h1>Frequently asked questions</h1><p>Helpful answers for ordering, payment, pickup and product enquiries.</p></div></section><section className="section"><div className="shell faq-list">{faqs.map(([q,a],i) => <details open={i===0} key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section></>; }
