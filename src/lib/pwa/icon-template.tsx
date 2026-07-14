export function AppIcon({
  label = "CP",
  maskable = false,
}: {
  label?: string;
  maskable?: boolean;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        background: maskable
          ? "radial-gradient(circle at top left, #b3a8fb 0%, #6d5ef2 30%, #120f0d 100%)"
          : "radial-gradient(circle at top left, #9c8ef5 0%, #6d5ef2 35%, #1a1613 100%)",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          border: maskable ? "24px solid rgba(255, 244, 232, 0.16)" : "16px solid rgba(255, 244, 232, 0.18)",
          borderRadius: maskable ? 160 : 120,
          display: "flex",
          height: maskable ? 392 : 360,
          justifyContent: "center",
          padding: maskable ? 34 : 24,
          width: maskable ? 392 : 360,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(160deg, rgba(40,155,141,0.96), rgba(18,15,13,0.92))",
            borderRadius: maskable ? 116 : 88,
            boxShadow: "0 32px 80px rgba(0, 0, 0, 0.28)",
            color: "#fff4e8",
            display: "flex",
            fontSize: maskable ? 164 : 160,
            fontWeight: 700,
            height: "100%",
            justifyContent: "center",
            letterSpacing: "-0.08em",
            width: "100%",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
