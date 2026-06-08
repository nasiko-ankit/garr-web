import { redirect } from "next/navigation";

// /registry now shows the Registry Server manager (previously at /rap)
export default function RegistryRedirectPage() {
  redirect("/rap");
}
