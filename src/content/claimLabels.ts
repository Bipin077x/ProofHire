import { Briefcase, Building, LinkIcon, Mail, CreditCard, AlertOctagon, Flag } from "lucide-react";

export const claimLabels: Record<string, { label: string; Icon: any }> = {
  payment: { label: "Payment", Icon: CreditCard },
  contact: { label: "Contact Info", Icon: Mail },
  company: { label: "Company", Icon: Building },
  role: { label: "Role", Icon: Briefcase },
  link: { label: "Links", Icon: LinkIcon },
  pressure: { label: "Pressure Tactics", Icon: AlertOctagon },
  reports: { label: "Community Reports", Icon: Flag }
};
