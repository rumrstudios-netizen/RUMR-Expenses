import Image from 'next/image';

export default function Brand() {
  return (
    <a className="brand expense-brand" href="/" aria-label="RUMR Expense home">
      <Image src="/rumr-wordmark.svg" alt="" width={92} height={46} unoptimized />
      <span className="expense-brand-label">Expense</span>
    </a>
  );
}
