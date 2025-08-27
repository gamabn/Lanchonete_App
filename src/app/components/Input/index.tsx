"use client"
import { RegisterOptions, UseFormRegister, Control, Controller} from "react-hook-form"
import { formatReal, parseRealToCents } from "@/app/components/money"


interface InputProps{
    id?: string;
    step?: number;
    type: string;
    name: string;
    placeholder: string;
    register: UseFormRegister<any>;
     control?: Control<any>; // Adiciona a propriedade control para uso com Controller
    error?: string;
    rules?: RegisterOptions;
     currency?: boolean;
     disabled?: boolean;

}
export function Input({placeholder, register, type, name, error, control, id, step,  currency, rules}: InputProps){
     if (currency && control) {
    return(
          <Controller
                name={name}
                control={control}
                rules={rules}
                render={({ field }) => (
                     <>
                        <input
                            id={id}
                            className="w-full border text-black rounded-xl px-2 h-11 "
                            placeholder={placeholder}
                            type="text" // Sempre 'text' para inputs de moeda
                            value={typeof field.value === 'number' ? formatReal(field.value) : field.value || ''}
                            onChange={(e) => { const rawValue = e.target.value; field.onChange(rawValue); }}
                            onBlur={(e) => { const parsedCents = parseRealToCents(e.target.value); const formattedCleanedValue = formatReal(parsedCents); field.onChange(formattedCleanedValue); field.onBlur(); }}
                            name={field.name}
                            ref={field.ref}
                        />
                        {error && <span className="text-red-500 text-sm">{error}</span>}
                    </>
                )}
            />
        );
    }

    return(
   <>
    <input 
    id={id} // Utiliza a propriedade id
    className="w-full border text-black rounded-xl px-2 h-11"
    placeholder={placeholder}
    type={type}
    step={step} // Utiliza a propriedade step
    {...(register && register(name, rules))}
    
     />
     {error && <span className="text-red-500 text-sm">{error}</span>}
   </>
    )
}