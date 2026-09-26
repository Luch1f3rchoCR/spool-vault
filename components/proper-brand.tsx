import { brand } from "@/lib/brand";

export function ProperWordmark({ light = false }: { light?: boolean }) {
  // Keep the supplied paths/proportions: the logo is not rendered as live text.
  return <img className="proper-wordmark" src={light ? brand.wordmarkLight : brand.wordmark}
    width={143} height={43} alt={brand.name} />;
}

export function ProperSignature() {
  return <div className="proper-signature">
    <ProperWordmark />
    <p>{brand.tagline}</p>
  </div>;
}
