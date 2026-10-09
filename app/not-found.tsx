import Link from "next/link";
import { BRAND_NAME } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-350 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-4xl font-extrabold text-primary-600">404</h1>
      <p className="text-lg font-semibold text-foreground">Page not found</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist on {BRAND_NAME}.
      </p>
      <Link href="/" className="rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">
        Back to Home
      </Link>
    </div>
  );
}
