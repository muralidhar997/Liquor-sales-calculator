import LoginCard from "../components/LoginCard";

export default function HomePage() {
  return (
    <div className="grid place-items-center">
      <div className="w-full max-w-md">
        <LoginCard />
        <div className="mt-4 text-xs text-zinc-600">
          Tip: On phone, the user page is single-column. On laptop, it splits into two halves.
        </div>
      </div>
    </div>
  );
}
