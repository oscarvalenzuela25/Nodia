import type { SaleTicketModel } from "../../../../../infrastructure/saleTicket";
import { AmountRow, Paper, QuantityPrice, Total } from "./styles";

export default function SaleTicket({ ticket }: { ticket: SaleTicketModel }) {
  return <Paper aria-label={ticket.title}>
    <header><h3>{ticket.businessName ?? ticket.title}</h3>{ticket.businessName && <p>{ticket.title}</p>}
      {ticket.saleId && <p>{ticket.saleId}</p>}{ticket.issuedAt && <p>{ticket.issuedAt}</p>}
    </header>
    {ticket.lines.length > 0 && <ul>{ticket.lines.map((line, index) => <li key={index}>
      <strong>{line.name}</strong>
      <AmountRow><QuantityPrice><span>{line.quantity}</span><span>×</span><span>{line.unitPrice}</span></QuantityPrice><strong>{line.subtotal}</strong></AmountRow>
    </li>)}</ul>}
    <Total><span>{ticket.totalLabel}</span><span>{ticket.total}</span></Total>
    <footer><p>{ticket.paymentLabel}: {ticket.paymentMethod}</p><p>{ticket.footer}</p></footer>
  </Paper>;
}
