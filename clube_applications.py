
class ApplicationSubmit(BaseModel):
    application_type:str
    organization_name:str=Field(min_length=3,max_length=200)
    contact_name:str=Field(min_length=3,max_length=160)
    contact_email:str
    contact_phone:str|None=Field(default=None,max_length=40)
    employee_count:int|None=Field(default=None,ge=1)
    notes:str|None=Field(default=None,max_length=2000)
class ApplicationReview(BaseModel):
    status:str
    reason:str=Field(min_length=5,max_length=350)

@app.post("/applications",status_code=201)
def submit_application(data:ApplicationSubmit):
    if data.application_type not in ("company","provider"):
        raise HTTPException(422,"Tipo de solicitação inválido")
    email=valid_email(data.contact_email)
    with db() as c:
        row=c.execute("""insert into ptp_applications
         (application_type,organization_name,contact_name,contact_email,contact_phone,employee_count,notes)
         values (%s,%s,%s,%s,%s,%s,%s) returning id,submitted_at""",
         (data.application_type,data.organization_name.strip(),data.contact_name.strip(),email,
          data.contact_phone,data.employee_count,data.notes)).fetchone()
        c.commit()
    return {"status":"pending","application_id":row["id"],"submitted_at":row["submitted_at"],"message":"Solicitação registrada para análise da equipe PTP. Não constitui adesão ou liberação de acesso."}

@app.get("/admin/applications")
def list_applications(u=Depends(require("admin"))):
    with db() as c:
        rows=c.execute("""select id,application_type,organization_name,contact_name,contact_email,
          contact_phone,employee_count,notes,status,submitted_at,reviewed_at from ptp_applications
          order by submitted_at desc limit 200""").fetchall()
    return {"applications":[dict(row) for row in rows]}

@app.post("/admin/applications/{application_id}/review")
def review_application(application_id:int,data:ApplicationReview,u=Depends(require("admin"))):
    if data.status not in ("under_review","approved","rejected"):
        raise HTTPException(422,"Situação inválida")
    with db() as c:
        row=c.execute("""update ptp_applications set status=%s,reviewed_by=%s,reviewed_at=now()
            where id=%s returning id,status""",(data.status,u["id"],application_id)).fetchone()
        if not row:raise HTTPException(404,"Solicitação não encontrada")
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",
                  (u["id"],"application_"+data.status,str(application_id)))
        c.commit()
    return dict(row)
