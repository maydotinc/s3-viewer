import { Input } from '@barberflow/ui/components/input';
import { useAuthStore } from '@barberflow/ui/lib/auth-store';
import { cn } from '@barberflow/ui/lib/utils';
import { useEffect } from 'react';
import { debounce } from 'lodash';
import { useMemo } from 'react';
import { useCallback } from 'react';

const NameInput = () => {
  const { name, setName, invalidFields, setInvalidFields } = useAuthStore();

  const validateName = useCallback(
    (value: string) => {
      const isValid = value.trim().length > 0;
      if (isValid) {
        setInvalidFields(invalidFields.filter((field) => field !== 'name'));
      } else if (!invalidFields.includes('name')) {
        setInvalidFields([...invalidFields, 'name']);
      }
    },
    [setInvalidFields, invalidFields, name, setName],
  );

  const debouncedValidateName = useMemo(() => debounce(validateName, 100), [validateName]);

  useEffect(() => {
    return () => {
      debouncedValidateName.cancel();
    };
  }, [debouncedValidateName]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    debouncedValidateName(value);
  };

  return (
    <div className="flex flex-col gap-0">
      <label className="text-sm font-medium text-black">Name</label>
      <Input
        type="text"
        placeholder="John Doe"
        className={cn('w-full transition-colors duration-300', invalidFields.includes('name') && 'border-red-500')}
        value={name}
        onChange={handleNameChange}
      />
    </div>
  );
};

export default NameInput;
