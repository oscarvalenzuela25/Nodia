import { createContext } from "react";
// Session and property access are distinct: an unresolved write can remain reviewable
// after access is revoked, while all new commands and dependent reads are disabled.
export const RentalAccessContext = createContext(true);
