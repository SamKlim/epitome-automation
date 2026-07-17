"""SurveyMonkey API client for the Epitome pipeline.

Pulls completed responses and converts each into
{statement text -> rank}, ready for score_from_statements(). Matching is
by statement TEXT, so it works across collectors and survives question
reordering.

NOTE: written offline against SurveyMonkey API v3 documentation; the
first live run should be against one known response to confirm the
ranking payload shape (see _extract_ranks). API access requires a
SurveyMonkey plan that includes the API, and a token from
https://developer.surveymonkey.com (app with responses_read scope).
"""
import requests

BASE = "https://api.surveymonkey.com/v3"


class SurveyMonkeyClient:
    def __init__(self, access_token, survey_id):
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {access_token}",
                               "Content-Type": "application/json"})
        self.survey_id = survey_id
        self._row_text = None      # row_id -> statement text
        self._choice_rank = None   # choice_id -> rank int (1-4)

    # -- survey structure -------------------------------------------------
    def load_structure(self):
        r = self.s.get(f"{BASE}/surveys/{self.survey_id}/details")
        r.raise_for_status()
        details = r.json()
        self._row_text, self._choice_rank = {}, {}
        for page in details.get("pages", []):
            for q in page.get("questions", []):
                answers = q.get("answers", {})
                for row in answers.get("rows", []):
                    self._row_text[row["id"]] = row["text"]
                for i, ch in enumerate(answers.get("choices", []), start=1):
                    # ranking choices: prefer numeric text, else position
                    t = ch.get("text", "").strip()
                    self._choice_rank[ch["id"]] = int(t) if t.isdigit() else i
        return details

    # -- responses ---------------------------------------------------------
    def completed_responses(self, start_created_at=None, per_page=100):
        """Yield completed responses (bulk endpoint), oldest first."""
        if self._row_text is None:
            self.load_structure()
        params = {"per_page": per_page, "status": "completed",
                  "sort_order": "ASC"}
        if start_created_at:
            params["start_created_at"] = start_created_at
        url = f"{BASE}/surveys/{self.survey_id}/responses/bulk"
        while url:
            r = self.s.get(url, params=params)
            r.raise_for_status()
            data = r.json()
            for resp in data.get("data", []):
                yield self._parse(resp)
            url = data.get("links", {}).get("next")
            params = None  # next link already carries the query

    def _parse(self, resp):
        statements = {}
        first = last = email = None
        for page in resp.get("pages", []):
            for q in page.get("questions", []):
                for a in q.get("answers", []):
                    # ranking answers carry row_id + choice_id
                    if "row_id" in a and "choice_id" in a:
                        row, ch = a["row_id"], a["choice_id"]
                        if row in self._row_text and ch in self._choice_rank:
                            statements[self._row_text[row]] = \
                                self._choice_rank[ch]
                    # open-text contact fields
                    elif "text" in a:
                        t = a["text"].strip()
                        if "@" in t and email is None:
                            email = t
                        elif first is None:
                            first = t
                        elif last is None:
                            last = t
        return {
            "response_id": resp["id"],
            "created_at": resp.get("date_created"),
            "first_name": first, "last_name": last, "email": email,
            "statements": statements,
        }
