import { Spinner } from 'datocms-react-ui';
import type { Status } from '../../utils/useStore';
import s from './styles.module.css';

export type ListStatusProps = {
  status: Status;
  isEmpty: boolean;
  emptyMessage: string;
};

/** Spinner, empty and error states shared by the product and variant lists. */
export default function ListStatus({
  status,
  isEmpty,
  emptyMessage,
}: ListStatusProps) {
  return (
    <>
      {status === 'loading' && <Spinner size={25} placement="centered" />}
      {status === 'success' && isEmpty && (
        <div className={s.empty}>{emptyMessage}</div>
      )}
      {status === 'error' && <div className={s.empty}>API call failed!</div>}
    </>
  );
}
