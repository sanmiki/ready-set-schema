import { z } from "zod";

// Every user-facing string here is Georgian: these messages are what the seller
// sees when a form or an upload is rejected.

const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, tooLong).optional().or(z.literal(""));

export const listingFieldsSchema = z.object({
  title: z
    .string({ required_error: "სათაური აუცილებელია" })
    .trim()
    .min(3, "სათაური მინიმუმ 3 სიმბოლო უნდა იყოს")
    .max(120, "სათაური 120 სიმბოლოზე მეტი ვერ იქნება"),
  description: z
    .string()
    .trim()
    .max(4000, "აღწერა 4000 სიმბოლოზე მეტი ვერ იქნება")
    .optional()
    .or(z.literal("")),
  brand: optionalText(60, "ბრენდი 60 სიმბოლოზე მეტი ვერ იქნება"),
  size: optionalText(30, "ზომა 30 სიმბოლოზე მეტი ვერ იქნება"),
  color: optionalText(40, "ფერი 40 სიმბოლოზე მეტი ვერ იქნება"),
  condition: z.enum(["new", "like_new", "good", "fair"], {
    errorMap: () => ({ message: "აირჩიეთ მდგომარეობა" }),
  }),
  price: z.coerce
    .number({ invalid_type_error: "ფასი რიცხვი უნდა იყოს" })
    .min(0, "ფასი უარყოფითი ვერ იქნება")
    .max(1000000, "ფასი 1 000 000 ₾-ზე მეტი ვერ იქნება"),
  city: optionalText(80, "ქალაქი 80 სიმბოლოზე მეტი ვერ იქნება"),
  neighborhood: optionalText(80, "უბანი 80 სიმბოლოზე მეტი ვერ იქნება"),
  categorySlug: optionalText(60, "კატეგორია 60 სიმბოლოზე მეტი ვერ იქნება"),
});

export type ListingFields = z.infer<typeof listingFieldsSchema>;

export const profileFieldsSchema = z.object({
  username: z
    .string({ required_error: "მომხმარებლის სახელი აუცილებელია" })
    .trim()
    .min(3, "მომხმარებლის სახელი მინიმუმ 3 სიმბოლო უნდა იყოს")
    .max(30, "მომხმარებლის სახელი 30 სიმბოლოზე მეტი ვერ იქნება")
    .regex(/^[a-z0-9_.]+$/, "მხოლოდ პატარა ასოები, ციფრები, წერტილი და ქვედა ხაზი"),
  display_name: optionalText(60, "სახელი 60 სიმბოლოზე მეტი ვერ იქნება"),
  city: optionalText(80, "ქალაქი 80 სიმბოლოზე მეტი ვერ იქნება"),
  bio: optionalText(500, "ცნობადი 500 სიმბოლოზე მეტი ვერ იქნება"),
});

export type ProfileFields = z.infer<typeof profileFieldsSchema>;

export const signInSchema = z.object({
  email: z.string({ required_error: "ელ. ფოსტა აუცილებელია" }).trim().email("ელ. ფოსტა არასწორია"),
  password: z.string({ required_error: "პაროლი აუცილებელია" }).min(1, "პაროლი აუცილებელია"),
});

export const signUpSchema = signInSchema
  .extend({
    password: z
      .string({ required_error: "პაროლი აუცილებელია" })
      .min(8, "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს"),
    display_name: optionalText(60, "სახელი 60 სიმბოლოზე მეტი ვერ იქნება"),
  })
  .refine((value) => value.password.length >= 8, {
    message: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს",
    path: ["password"],
  });

export const newPasswordSchema = z.object({
  password: z
    .string({ required_error: "პაროლი აუცილებელია" })
    .min(8, "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს"),
});

export function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "მონაცემები არასწორია";
}
