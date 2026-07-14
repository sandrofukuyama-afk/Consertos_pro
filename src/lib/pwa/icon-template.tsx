export function AppIcon({
  maskable = false,
}: {
  maskable?: boolean;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #6d5ef2 0%, #289b8d 100%)",
        borderRadius: maskable ? 0 : 138,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg
        width={maskable ? 240 : 300}
        height={maskable ? 240 : 300}
        viewBox="0 0 48 48"
        fill="none"
      >
        <path
          d="M11 25h5.5l2.6-7.5 4.4 15 3.4-11 2.1 3.5H37"
          stroke="#ffffff"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
