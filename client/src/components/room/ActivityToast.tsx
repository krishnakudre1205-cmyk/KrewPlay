type ActivityToastProps = {
  text: string;
};

export default function ActivityToast({
  text,
}: ActivityToastProps) {
  if (!text) return null;

  return (
    <div className="mb-5 w-fit rounded-xl border border-[#B497FF] bg-[#23172E] px-5 py-3 text-[#E9DDFF] shadow-lg">
      {text}
    </div>
  );
}