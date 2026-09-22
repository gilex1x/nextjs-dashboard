'use server'
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';


export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};


const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer'
    }),
    amount: z.coerce.number().gt(0,'Please enter a value greater than 0'),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status'
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedCustomFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });
    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedCustomFields.success) {
        return {
            errors: validatedCustomFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
    const { customerId, amount, status } = validatedCustomFields.data;
    const date = new Date().toISOString().split('T')[0];
    console.log(customerId, amount, status);
    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amount}, ${status}, ${date})
      `;

    } catch (error) {
        console.error(error);
        return {
            message: 'Somenthing went wrong, please try later'
        }
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function updateInvoice(id: string, formData: FormData) {

    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;
    try {

        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
    } catch (error) {
        console.error(error);
        return {
            message: 'Somenthing went wrong, please try later'
        }
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    } catch (error) {
        console.error(error);
        return {
            message: 'Somenthing went wrong, please try later'
        }
    }
    revalidatePath('/dashboard/invoices');
}