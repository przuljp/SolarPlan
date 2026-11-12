"""Controlled role assignment: python -m app.admin_cli promote --email ADDRESS."""

import argparse
import asyncio

from app.db.session import async_session_factory
from app.services.admin_service import promote_admin


async def run(email: str) -> None:
    async with async_session_factory() as session:
        await promote_admin(session, email)
    print("Administrator role assigned to the existing active account.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    promote = commands.add_parser("promote", help="Promote an existing active account")
    promote.add_argument("--email", required=True)
    args = parser.parse_args()
    try:
        asyncio.run(run(args.email))
    except ValueError as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
