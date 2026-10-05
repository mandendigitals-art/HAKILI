// Ces suites écrivent dans la base : leur nom doit indiquer une base de test.
const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error("Les tests d'intégration exigent DATABASE_URL vers une base dont le nom finit par _test.");
}
export {};
