import { VerifyResult } from "./types";
import { verifyPayment } from "./payment";
import { verifyContact } from "./contact";
import { verifyCompany } from "./company";
import { verifyPressure } from "./pressure";

export function runOfflineVerifiers(claims: any): VerifyResult[] {
  return [
    verifyPayment(claims),
    verifyContact(claims),
    verifyCompany(claims),
    verifyPressure(claims),
  ];
}
