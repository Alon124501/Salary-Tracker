import AnimatedModal from './AnimatedModal.jsx';
import DeviceChecklist from './DeviceChecklist.jsx';

export default function DeviceRecapModal({
  onSubmitted,
  title = 'סיכום ציוד שבועי',
  subtitle = 'אנא אשר אילו מכשירים ברשותך כעת.',
  submitLabel = 'שלח',
}) {
  return (
    <AnimatedModal open zIndex={50} backdropClassName="bg-black/50">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 font-headline">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {subtitle}
          </p>
        </div>

        <DeviceChecklist source="weekly" submitLabel={submitLabel} onSubmitted={() => onSubmitted()} />
      </div>
    </AnimatedModal>
  );
}
