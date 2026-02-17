import sqlite3

conn = sqlite3.connect(r"C:\Users\EFEROS\OneDrive - EFE\Documentos\Proyectos\Atravieso y Paralelismo\pwa-backend\datos.db")
cursor = conn.cursor()

cursor.execute("SELECT * FROM usuarios")
print(cursor.fetchall())

conn.commit()
conn.close()