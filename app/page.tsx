import type { Metadata } from "next";
import { headers } from "next/headers";
import { InventoryApp } from "./inventory-app";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    openGraph: {
      title: "Juanitos · Inventario y compras",
      description: "Un prototipo simple para registrar existencias y preparar la Solicitud de compra.",
      images: [{ url: imageUrl, width: 1536, height: 1024, alt: "Juanitos · Inventario y compras" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Juanitos · Inventario y compras",
      description: "Un prototipo simple para registrar existencias y preparar la Solicitud de compra.",
      images: [imageUrl],
    },
  };
}

export default function Home() {
  return <InventoryApp />;
}
